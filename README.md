# Certificate Registry — React + Express

Private registry with public certificate search and password-protected admin dashboard. Starts with **zero** records. Uploaded IAF image is displayed as a reference image only and is **not** a claim of accreditation.

## Setup
1. Install Node.js 22+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a strong unique `ADMIN_PASSWORD` (12+ characters) and random `SESSION_SECRET` (24+ characters). Never commit `.env`.
4. Run `npm run dev`.
5. Open `http://localhost:5173` for public search and click **Admin Dashboard** to log in.

## Workflow
- Add company name, unique certificate number, ISO type, issue/expiry dates, scope.
- Check **Show in public search** to publish. Records are hidden by default.
- Public search requires exact certificate number and company-name prefix of at least 3 characters.
- Edit, hide or delete certificates from Admin Dashboard.
- Records persist in `server/records.json` (back this up securely).

## Important production notes
- This is an independently managed registry, not an official certificate verification service.
- Do not present the IAF mark as your accreditation. Only use logos you are authorized to display; remove `public/iaf.png` if not authorized.
- Protect deployment with HTTPS, strong credentials, backups, and appropriate access controls. The single-admin JSON storage is suitable for a small deployment/prototype; for larger deployments migrate to a database and managed authentication.
- Vite proxies `/api` to port 3001 in development. In production reverse-proxy `/api` to the Express server.


## Admin URL
The public site is `/`. Admin login is only at `/admin` (not linked in the public header). The server enforces authorization on every administrative API request; obscuring the URL is not itself a security measure.

## Logos and certification status
Images in the header were provided by the user as visual references. Their presence does not establish an affiliation, endorsement or accreditation. Only display logos when authorized by their owners. The registry is privately managed and cannot itself verify third-party certification.
