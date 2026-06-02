# Azure Secret Lookup Guide — WinMovers Operations

Use this guide when you need to recover or verify the secret values used by the repository before or after a transfer.

Important: GitHub does not let you view the plaintext value of an existing secret. If you do not already know a value, create a replacement in Azure or the source system, copy it immediately, then update GitHub with the new value.

## Secrets Used By This Repository

### GitHub Actions / Deployment Secrets

- `ACR_NAME`
- `AZURE_APP_ID`
- `AZURE_PASSWORD`
- `AZURE_TENANT`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_MAIL_FROM`
- `DATABASE_URL`

### Optional / Related Values

- `AZURE_TENANT_ID` — often the same value as `AZURE_TENANT`
- `AZURE_STORAGE_CONNECTION_STRING` — used by App Service runtime
- `AZURE_STORAGE_CONTAINER` — usually `job-files`

## Where To Find Each Value In Azure

### 1) `ACR_NAME`

Go to Azure Portal > **Container registries** > open the registry used by the app.

Copy the **Registry name** only.

Example:

- Registry name: `winmoversops`
- Do not include `.azurecr.io`

### 2) `AZURE_TENANT` / `AZURE_TENANT_ID`

Go to Azure Portal > **Microsoft Entra ID** > **Overview**.

Copy the **Tenant ID**.

If both secret names are used, they usually hold the same value.

### 3) `AZURE_APP_ID`

Go to Azure Portal > **Microsoft Entra ID** > **App registrations**.

Open the app registration used for GitHub Actions deployment.

Copy the **Application (client) ID** from the Overview page.

### 4) `AZURE_PASSWORD`

In the same App registration used for deployment:

1. Open **Certificates & secrets**.
2. Check **Client secrets**.
3. If you already saved the secret value elsewhere, reuse that exact value.
4. If you do not know the value, create a new client secret.
5. Copy the **Value** immediately.

Do not confuse the secret **Value** with the secret **ID**.

### 5) `AZURE_CLIENT_ID`

Go to Azure Portal > **Microsoft Entra ID** > **App registrations**.

Open the application used by the runtime app features that need Azure identity.

Copy the **Application (client) ID**.

### 6) `AZURE_CLIENT_SECRET`

In that runtime App registration:

1. Open **Certificates & secrets**.
2. Add or find a client secret.
3. If the old value is not available, create a new secret.
4. Copy the **Value** immediately.

### 7) `AZURE_MAIL_FROM`

Find the sender address in the service that actually sends mail.

Common places:

- Azure Communication Services Email
- Microsoft 365 / Exchange sender identity
- Another SMTP or mail provider configured by the app

Use the verified sender email address, for example `no-reply@yourdomain.com`.

### 8) `DATABASE_URL`

Go to Azure Portal > **Azure Database for PostgreSQL** > open the server used by the app.

Collect:

- Server name
- Database name
- Admin username
- Password

Build the connection string in this format:

```text
postgresql://USERNAME:PASSWORD@SERVER.postgres.database.azure.com:5432/DATABASE?sslmode=require
```

If you do not know the password, you will need to reset it and then update GitHub with the new value.

### 9) `AZURE_STORAGE_CONNECTION_STRING`

Go to Azure Portal > **Storage accounts** > open the storage account used for file attachments.

Then go to **Access keys** or **Security + networking** > **Access keys**.

Copy the full connection string for the account.

### 10) `AZURE_STORAGE_CONTAINER`

Go to Azure Portal > **Storage accounts** > open the storage account.

Go to **Data storage** > **Containers**.

Use the container name used by the app, usually `job-files`.

## Quick Verification Checklist

Before transferring the repository, confirm these values exist and are correct:

- `ACR_NAME` matches the registry name in Azure
- `AZURE_APP_ID` matches the deployment app registration
- `AZURE_PASSWORD` is a current valid client secret value
- `AZURE_TENANT` matches the Entra tenant ID
- `AZURE_CLIENT_ID` matches the runtime app registration
- `AZURE_CLIENT_SECRET` is a current valid client secret value
- `AZURE_MAIL_FROM` is a verified sender address
- `DATABASE_URL` connects to the correct PostgreSQL database
- `AZURE_STORAGE_CONNECTION_STRING` points to the correct storage account
- `AZURE_STORAGE_CONTAINER` matches the container name used by the app

## Safe Migration Notes

- Never store plaintext secret values in git.
- If a secret value is unknown, create a replacement and rotate the old one after validation.
- After repository transfer, re-check the same secret names in the new repo and run a deployment workflow to confirm they resolve correctly.