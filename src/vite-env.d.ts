/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string;
	readonly VITE_WS_URL?: string;
	readonly VITE_AVATAR_UPLOAD_ENDPOINT?: string;
	readonly VITE_AVATAR_UPLOAD_FIELD?: string;
	readonly VITE_DEBUG_STREAM?: string;
	readonly VITE_DEBUG_VOD_API?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
