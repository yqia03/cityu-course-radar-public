declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    APP_ORIGIN?: string;
    CONTACT_EMAIL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    ADMIN_USER_IDS?: string;
    BUCKET?: R2Bucket;
    MATERIALS?: R2Bucket;
    MATERIALS_UPLOAD_MODE?: string;
  }
}
