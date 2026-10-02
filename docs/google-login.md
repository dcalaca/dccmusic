# Google sign-in activation

The public login and signup pages use Google Identity Services. The backend verifies Google's RSA signature, issuer, audience, expiration, verified email and browser nonce before issuing the existing composer JWT. Supabase Auth is not used. Existing password hashes are preserved.

1. In Google Cloud Console, configure Google Auth Platform branding and audience for DCC Music.
2. Create an OAuth client of type Web application.
3. Add authorized JavaScript origins `https://www.dccmusic.online` and `https://dccmusic.online` (and `http://localhost:3000` for local development).
4. Set `GOOGLE_CLIENT_ID` on the Vercel production project to that web client ID, ending in `.apps.googleusercontent.com`. No client secret or redirect URI is required for this popup flow.
5. Publish the Google app for external users and deploy with the new environment variable.
6. Test an existing Gmail account: composer ID, credits, projects, subscription and password must remain intact. Test a new account and cancelled popup, then test email/password login.

The button stays hidden until the client ID and existing JWT signing secret are configured. The database migration is `database/SQL-GOOGLE-LOGIN.sql`; `google_sub` uniquely links the Google identity. Automatic linking by email is restricted to verified Gmail or Workspace identities. Other third-party email addresses continue through email/password login. Deleted accounts cannot obtain another free signup via Google.

New Google accounts receive a random, undisclosed bcrypt password hash and can set a password through the existing password recovery flow. Duplicate display names receive a short unique suffix; existing profiles are never renamed.
