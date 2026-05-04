const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} = require('@azure/storage-blob')
const { v4: uuidv4 } = require('uuid')
const path = require('path')

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'job-files'

// Parse AccountName and AccountKey from connection string for SAS generation
function parseCredentials() {
  const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1]
  const accountKey  = connectionString.match(/AccountKey=([^;]+)/)?.[1]
  if (!accountName || !accountKey) throw new Error('Invalid AZURE_STORAGE_CONNECTION_STRING')
  return { accountName, accountKey }
}

async function uploadFile(jobId, originalName, buffer, mimetype) {
  const ext      = path.extname(originalName)
  const year     = new Date().getUTCFullYear()
  const blobName = `${year}/${jobId}/${uuidv4()}${ext}`
  const client   = BlobServiceClient.fromConnectionString(connectionString)
  const container = client.getContainerClient(containerName)
  const blob      = container.getBlockBlobClient(blobName)
  await blob.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: mimetype },
  })
  return blobName
}

async function getDownloadUrl(storagePath) {
  const { accountName, accountKey } = parseCredentials()
  const credential = new StorageSharedKeyCredential(accountName, accountKey)
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: storagePath,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
    credential
  ).toString()
  return `https://${accountName}.blob.core.windows.net/${containerName}/${storagePath}?${sasToken}`
}

async function deleteFile(storagePath) {
  const client    = BlobServiceClient.fromConnectionString(connectionString)
  const container = client.getContainerClient(containerName)
  const blob      = container.getBlockBlobClient(storagePath)
  await blob.deleteIfExists()
}

async function uploadSignatureImage(staffId, buffer, mimetype) {
  const ext      = mimetype === 'image/png' ? '.png' : '.jpg'
  const blobName = `signatures/${staffId}${ext}`
  const client    = BlobServiceClient.fromConnectionString(connectionString)
  const container = client.getContainerClient(containerName)
  const blob      = container.getBlockBlobClient(blobName)
  await blob.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: mimetype },
  })
  return blobName
}

module.exports = { uploadFile, getDownloadUrl, deleteFile, uploadSignatureImage, downloadBlob }

async function downloadBlob(storagePath) {
  const client    = BlobServiceClient.fromConnectionString(connectionString)
  const container = client.getContainerClient(containerName)
  const blob      = container.getBlockBlobClient(storagePath)
  const download  = await blob.download(0)
  return { readableStream: download.readableStreamBody, contentType: download.contentType || 'application/octet-stream' }
}
