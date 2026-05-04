import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { SOCKJS_URL } from "@/shared/api/apiConfig";

type ConnectionState = "disconnected" | "connecting" | "connected";
type ConnectionListener = (state: ConnectionState) => void;
type SubscriptionFactory = () => StompSubscription | null;

type SubscribeHandler = (message: IMessage) => void;

const IDLE_DISCONNECT_MS = 15_000;

let client: Client | null = null;
let connectionState: ConnectionState = "disconnected";
let activeSubscriptions = 0;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
const connectionListeners = new Set<ConnectionListener>();
const pendingSubscriptions: SubscriptionFactory[] = [];

function setConnectionState(nextState: ConnectionState) {
  if (connectionState === nextState) return;
  connectionState = nextState;
  connectionListeners.forEach((listener) => listener(nextState));
}

function ensureClient(): Client {
  if (client) {
    return client;
  }

  client = new Client({
    webSocketFactory: () => new SockJS(SOCKJS_URL),
    reconnectDelay: 5_000,
    heartbeatIncoming: 10_000,
    heartbeatOutgoing: 10_000,
  });

  client.beforeConnect = async () => {
    const token = localStorage.getItem("accessToken");
    client!.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  };

  client.onConnect = () => {
    setConnectionState("connected");
    while (pendingSubscriptions.length > 0) {
      const subscribe = pendingSubscriptions.shift();
      subscribe?.();
    }
  };

  client.onDisconnect = () => {
    setConnectionState("disconnected");
  };

  client.onWebSocketClose = () => {
    setConnectionState("disconnected");
  };

  client.onStompError = () => {
    setConnectionState("disconnected");
  };

  return client;
}

function scheduleDisconnectIfIdle() {
  if (activeSubscriptions > 0) {
    return;
  }

  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
  }

  disconnectTimer = setTimeout(() => {
    if (activeSubscriptions > 0 || !client?.active) {
      return;
    }

    client.deactivate();
    setConnectionState("disconnected");
  }, IDLE_DISCONNECT_MS);
}

export function getStompConnectionState(): ConnectionState {
  return connectionState;
}

export function onStompConnectionChange(listener: ConnectionListener) {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

export function subscribeToTopic(destination: string, handler: SubscribeHandler) {
  const activeClient = ensureClient();
  activeSubscriptions += 1;

  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }

  let subscription: StompSubscription | null = null;
  let isDisposed = false;

  const subscribeNow: SubscriptionFactory = () => {
    if (!activeClient.connected || isDisposed) {
      return null;
    }

    subscription = activeClient.subscribe(destination, handler);
    return subscription;
  };

  if (activeClient.connected) {
    subscribeNow();
  } else {
    pendingSubscriptions.push(subscribeNow);
    if (!activeClient.active) {
      setConnectionState("connecting");
      activeClient.activate();
    }
  }

  return () => {
    isDisposed = true;
    if (subscription) {
      subscription.unsubscribe();
    }

    activeSubscriptions = Math.max(0, activeSubscriptions - 1);
    scheduleDisconnectIfIdle();
  };
}

export function publishMessage(destination: string, body: string): boolean {
  if (!client?.connected) {
    return false;
  }

  client.publish({ destination, body });
  return true;
}
