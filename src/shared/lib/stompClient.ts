import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { SOCKJS_URL } from "@/shared/api/apiConfig";
import { chatDebug, chatDebugError, chatDebugWarn } from "@/shared/lib/chatDebug";

type ConnectionState = "disconnected" | "connecting" | "connected";
type ConnectionListener = (state: ConnectionState) => void;
type PublishHeaders = Record<string, string>;

type SubscribeHandler = (message: IMessage) => void;

interface SubscriptionRecord {
  destination: string;
  handler: SubscribeHandler;
  subscription: StompSubscription | null;
  isDisposed: boolean;
}

const IDLE_DISCONNECT_MS = 15_000;
const AUTHORIZATION_HEADER = "Authorization";

let client: Client | null = null;
let connectionState: ConnectionState = "disconnected";
let activeSubscriptions = 0;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
const connectionListeners = new Set<ConnectionListener>();
const subscriptionRecords = new Set<SubscriptionRecord>();

function buildAuthorizationHeaders(): PublishHeaders {
  const token = localStorage.getItem("accessToken");
  return token ? { [AUTHORIZATION_HEADER]: `Bearer ${token}` } : {};
}

function hasAccessToken(): boolean {
  try {
    return Boolean(localStorage.getItem("accessToken"));
  } catch {
    return false;
  }
}

function setConnectionState(nextState: ConnectionState) {
  if (connectionState === nextState) return;
  connectionState = nextState;
  connectionListeners.forEach((listener) => listener(nextState));
}

function subscribeRecord(activeClient: Client, record: SubscriptionRecord) {
  if (!activeClient.connected || record.isDisposed) {
    return;
  }

  if (record.subscription) {
    try {
      record.subscription.unsubscribe();
    } catch {
      // The old subscription can already be invalid after reconnect.
    }
  }

  chatDebug("stomp", "subscribe", { destination: record.destination });
  record.subscription = activeClient.subscribe(record.destination, record.handler);
}

function ensureClient(): Client {
  if (client) {
    return client;
  }

  client = new Client({
    webSocketFactory: () => {
      chatDebug("stomp", "open SockJS socket", { url: SOCKJS_URL });
      return new SockJS(SOCKJS_URL);
    },
    reconnectDelay: 5_000,
    heartbeatIncoming: 10_000,
    heartbeatOutgoing: 10_000,
  });

  client.beforeConnect = async () => {
    client!.connectHeaders = buildAuthorizationHeaders();
    chatDebug("stomp", "connect", { hasToken: hasAccessToken() });
  };

  client.onConnect = () => {
    chatDebug("stomp", "connected");
    setConnectionState("connected");
    subscriptionRecords.forEach((record) => subscribeRecord(client!, record));
  };

  client.onDisconnect = () => {
    chatDebug("stomp", "disconnected");
    setConnectionState("disconnected");
  };

  client.onWebSocketClose = (event) => {
    chatDebugWarn("stomp", "websocket closed", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });
    setConnectionState("disconnected");
  };

  client.onStompError = (frame) => {
    chatDebugError("stomp", "broker error", {
      headers: frame.headers,
      body: frame.body,
    });
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

export function ensureStompConnection() {
  const activeClient = ensureClient();

  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }

  if (!activeClient.active) {
    setConnectionState("connecting");
    activeClient.activate();
  }
}

export function subscribeToTopic(destination: string, handler: SubscribeHandler) {
  const activeClient = ensureClient();
  activeSubscriptions += 1;

  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }

  const record: SubscriptionRecord = {
    destination,
    handler,
    subscription: null,
    isDisposed: false,
  };
  subscriptionRecords.add(record);

  if (activeClient.connected) {
    subscribeRecord(activeClient, record);
  } else {
    chatDebug("stomp", "queue subscribe until connected", { destination });
    if (!activeClient.active) {
      setConnectionState("connecting");
      activeClient.activate();
    }
  }

  return () => {
    record.isDisposed = true;
    subscriptionRecords.delete(record);
    if (record.subscription) {
      chatDebug("stomp", "unsubscribe", { destination });
      record.subscription.unsubscribe();
      record.subscription = null;
    }

    activeSubscriptions = Math.max(0, activeSubscriptions - 1);
    scheduleDisconnectIfIdle();
  };
}

export function publishMessage(
  destination: string,
  body: string,
  headers: PublishHeaders = {},
): boolean {
  if (!client?.connected) {
    chatDebugWarn("stomp", "publish requested while disconnected", { destination });
    ensureStompConnection();
    return false;
  }

  chatDebug("stomp", "publish", { destination, hasToken: hasAccessToken() });
  client.publish({
    destination,
    body,
    headers: {
      ...buildAuthorizationHeaders(),
      ...headers,
    },
  });
  return true;
}
