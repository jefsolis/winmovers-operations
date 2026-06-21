# WT-LB-02 Azure Execution Guide

This document explains how to execute the weight conversion in your Azure environment (Azure App Service + Azure Database for PostgreSQL).

Reference deployment:
- App Service: `winmovers-ops-2026`
- Resource Group: `winmovers-rg`
- PostgreSQL Server: `winmovers-db` (or similar)

---

## Prerequisites on Azure

1. **Azure CLI installed locally**
   ```powershell
   winget install --id Microsoft.AzureCLI -e --source winget
   az --version  # Verify installation
   ```

2. **Logged into Azure CLI**
   ```powershell
   az login
   az account set --subscription "<your-subscription-id>"
   ```

3. **App Service environment variables set**
   - Verify `DATABASE_URL` is already configured in App Service Application Settings.
   - Verify `NODE_ENV=production`.

---

## Step 1: Backup Azure PostgreSQL Database

### Option A: Azure Portal UI Snapshot (Recommended for Safety)

1. Go to **Azure Portal** → **Resource Groups** → `winmovers-rg` → PostgreSQL server (e.g., `winmovers-db`).
2. In left sidebar, click **Backups**.
3. Click **Create backup** (on-demand).
4. Wait for backup to complete and note the backup ID.
5. Take a screenshot or note the timestamp.

### Option B: Command Line pg_dump (Alternative)

Get PostgreSQL connection string from Azure Portal:
1. Go to PostgreSQL server → **Connection strings** → **Node.js**.
2. Copy the connection string.
3. On your local machine:
   ```powershell
   $conn = "postgres://user:password@server.postgres.database.azure.com:5432/winmovers?sslmode=require"
   pg_dump --format=custom --file="backup_pre_wt_lb_02_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump" "$conn"
   ```
4. Verify backup file exists and has size > 0.

**Recommended:** Use Azure Portal backup (Option A) as it is simpler and managed by Azure.

---

## Step 2: Deploy Code with Schema Update

### Option A: Automatic Deployment via GitHub Actions (If Configured)

1. Ensure code changes are in main branch:
   ```powershell
   git add backend/prisma/schema.prisma backend/routes/jobs.js backend/routes/movingFiles.js backend/scripts/convert-weights-kg-to-lb.js backend/package.json
   git commit -m "WT-LB-02: Add weight conversion guards and backfill script"
   git push origin main
   ```

2. GitHub Actions workflow (`.github/workflows/ci-deploy.yml`) will:
   - Build Docker image
   - Run `npx prisma db push` automatically
   - Push image to ACR
   - Deploy to App Service

3. Monitor deployment:
   ```powershell
   az webapp log tail --resource-group winmovers-rg --name winmovers-ops-2026 --follow
   ```

4. Wait for deployment to complete (check in Azure Portal or logs show "Ready to receive requests").

### Option B: Manual Deployment via Zip

1. From workspace root, build frontend:
   ```powershell
   cd frontend
   npm install
   npm run build
   cd ..
   ```

2. Prepare backend folder for deployment:
   ```powershell
   $backendDeploy = "C:\temp\winmovers-backend-deploy"
   Remove-Item $backendDeploy -Recurse -Force -ErrorAction SilentlyContinue
   New-Item -ItemType Directory -Path $backendDeploy -Force | Out-Null
   
   # Copy backend files except node_modules
   Get-ChildItem -Path "backend" -Force | Where-Object { $_.Name -ne 'node_modules' } | ForEach-Object {
     if ($_.PSIsContainer) {
       Copy-Item -Path $_.FullName -Destination $backendDeploy -Recurse -Force
     } else {
       Copy-Item -Path $_.FullName -Destination $backendDeploy -Force
     }
   }
   
   # Copy frontend build into backend/frontend
   $backendFrontend = Join-Path $backendDeploy "frontend"
   Remove-Item $backendFrontend -Recurse -Force -ErrorAction SilentlyContinue
   New-Item -ItemType Directory -Path $backendFrontend -Force | Out-Null
   Copy-Item -Path "frontend\dist\*" -Destination $backendFrontend -Recurse -Force
   ```

3. Create deployment zip:
   ```powershell
   $deployZip = "C:\temp\winmovers-backend-$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"
   Remove-Item $deployZip -Force -ErrorAction SilentlyContinue
   Compress-Archive -Path "$backendDeploy\*" -DestinationPath $deployZip -Force
   ```

4. Deploy zip to App Service:
   ```powershell
   az webapp deploy `
     --resource-group winmovers-rg `
     --name winmovers-ops-2026 `
     --src-path $deployZip `
     --type zip
   ```

5. Monitor logs:
   ```powershell
   az webapp log tail --resource-group winmovers-rg --name winmovers-ops-2026 --follow
   ```

6. Wait until you see "Ready to receive requests" (or similar success message).

---

## Step 3: Verify Schema Update Applied

Once deployed, verify Prisma schema was applied:

```powershell
az webapp ssh --resource-group winmovers-rg --name winmovers-ops-2026
```

Inside the SSH shell:
```bash
cd /home/site/wwwroot
node -e "const { getPrisma } = require('./db'); getPrisma().movingFile.findFirst({select:{id:true,weightUnit:true,weightConvertedAt:true}}).then(r => { console.log(r); process.exit(0) })"
```

Expected: Record printed (even if fields are null).

Exit SSH:
```bash
exit
```

---

## Step 4: Dry Run in Azure App Service

Connect via SSH:
```powershell
az webapp ssh --resource-group winmovers-rg --name winmovers-ops-2026
```

Inside the SSH shell:
```bash
cd /home/site/wwwroot
npm run weights:convert:dry
```

Expected output sections:
- Pre-run stats
- Run results
- Post-run remaining eligible rows

Copy the entire output and paste it into your sign-off document.

Exit SSH:
```bash
exit
```

---

## Step 5: Apply Conversion in Azure App Service

Connect via SSH:
```powershell
az webapp ssh --resource-group winmovers-rg --name winmovers-ops-2026
```

Inside the SSH shell:
```bash
cd /home/site/wwwroot
npm run weights:convert:apply
```

Watch for completion. Expected output:
- Summary: `converted=X, failed=0, mode=APPLY`

Copy the entire output and paste it into your sign-off document.

Exit SSH:
```bash
exit
```

---

## Step 6: Idempotency Check (Mandatory)

Connect via SSH:
```powershell
az webapp ssh --resource-group winmovers-rg --name winmovers-ops-2026
```

Inside the SSH shell:
```bash
cd /home/site/wwwroot
npm run weights:convert:dry
```

Expected output:
- Summary: `converted=0, failed=0, mode=DRY_RUN`
- Post-run eligible: `0` for both models

If this is true, conversion is complete and idempotent.

Exit SSH:
```bash
exit
```

---

## Step 7: Functional Verification

### Via Azure Portal Logs

Monitor App Service logs for errors:
```powershell
az webapp log tail --resource-group winmovers-rg --name winmovers-ops-2026 --follow
```

Look for any `ERROR` or `WARN` related to weight fields.

### Via Application UI

1. Open the deployed app in browser: `https://winmovers-ops-2026.azurewebsites.net`
2. Create a new file with weight value and verify it displays as LB.
3. Edit an existing job and verify weight label shows LB.
4. Check dashboard for expected pound totals.
5. Verify no 500 errors in browser console.

### Direct Database Query (Optional)

If you have PostgreSQL client installed:
```powershell
$conn = "postgres://user:password@server.postgres.database.azure.com:5432/winmovers?sslmode=require"
psql $conn -c "SELECT id, weightKg, weightUnit, weightConvertedAt FROM moving_file WHERE weightKg IS NOT NULL LIMIT 5;"
```

Expected: Some rows have `weightUnit='LB'` and `weightConvertedAt` is not null.

---

## Step 8: Rollback Plan (If Needed)

If critical issue detected:

### Restore from Azure Backup

1. Go to **Azure Portal** → PostgreSQL server → **Backups**.
2. Find pre-conversion backup.
3. Click **Restore**.
4. Choose target server (usually same server, overwrites current data).
5. Wait for restore to complete.

### Redeploy Previous App Version

```powershell
az webapp deployment slot create `
  --resource-group winmovers-rg `
  --name winmovers-ops-2026 `
  --slot backup
```

Then redeploy last known-good commit:
```powershell
git checkout <last-known-good-commit>
# Repeat Steps 1-2 of deployment
```

---

## Monitoring and Logs

### Real-time Logs
```powershell
az webapp log tail --resource-group winmovers-rg --name winmovers-ops-2026 --follow
```

### Historical Logs (Last 100 lines)
```powershell
az webapp log download `
  --resource-group winmovers-rg `
  --name winmovers-ops-2026 `
  --log-file C:\temp\app-logs.zip
```

### Application Insights (If Configured)
Go to Azure Portal → App Service → Application Insights → Logs and search for `"weightKg"` or `"weightUnit"`.

---

## Azure-Specific Gotchas

1. **SSH Session Timeout**: If SSH disconnects during conversion, run dry-run first to check progress. Script is idempotent.
2. **App Service CPU/Memory**: Monitor via Azure Portal → App Service → Metrics during conversion.
3. **Connection String**: Ensure `DATABASE_URL` in App Settings includes `?sslmode=require` for Azure PostgreSQL.
4. **Firewall Rules**: If conversion fails with "could not translate host name", check PostgreSQL Firewall rules allow App Service IP.

To allow App Service IP:
```powershell
$appServiceIP = az webapp show --resource-group winmovers-rg --name winmovers-ops-2026 --query "possibleOutboundIpAddresses" -o tsv

# Add to PostgreSQL firewall in Portal or via CLI:
az postgres server firewall-rule create `
  --resource-group winmovers-rg `
  --server-name <postgres-server> `
  --name "AllowAppService" `
  --start-ip-address $appServiceIP `
  --end-ip-address $appServiceIP
```

---

## Sign-off Template (Azure)

Record this after production run:
- Date/time: _______________
- Operator: _______________
- Azure Backup ID: _______________
- App Service: winmovers-ops-2026
- Deployment method: [GitHub Actions / Manual ZIP]
- Deployment timestamp: _______________
- Dry-run pre-check counts (from Step 4): _______________
- Apply counts (from Step 5): _______________
- Dry-run post-check counts (from Step 6): _______________
- Functional verification completed: [YES / NO]
- Any errors in logs: [NONE / Details: _______________]
- Final status: [SUCCESS / ROLLED BACK]
- Approver: _______________
