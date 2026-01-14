const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { BlobServiceClient } = require("@azure/storage-blob");

app.http("updateVideo", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "videos/{id}",
  handler: async (request, context) => {
    try {
      const id = request.params.id;

      const COSMOS_CONN = process.env.COSMOS_CONN;
      const COSMOS_DB = process.env.COSMOS_DB;
      const COSMOS_CONTAINER = process.env.COSMOS_CONTAINER;

      const BLOB_CONN = process.env.BLOB_CONN;
      const BLOB_CONTAINER = process.env.BLOB_CONTAINER || "videos";

      const patch = await request.json().catch(() => ({}));
      const {
        title,
        uploadedBy,
        description,
        url,
        fileBase64,
        fileName = "video.mp4",
        contentType = "video/mp4",
      } = patch;

      const cosmos = new CosmosClient(COSMOS_CONN);
      const container = cosmos.database(COSMOS_DB).container(COSMOS_CONTAINER);

      const { resource: existing } = await container.item(id, id).read();
      if (!existing) return { status: 404, jsonBody: { error: "Not found" } };

      let newBlobName = existing.blobName || null;
      let newBlobUrl = existing.blobUrl || null;

      // Optional: replace blob if new fileBase64 supplied
      if (fileBase64) {
        const blobSvc = BlobServiceClient.fromConnectionString(BLOB_CONN);
        const blobContainer = blobSvc.getContainerClient(BLOB_CONTAINER);
        await blobContainer.createIfNotExists();

        const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : ".mp4";
        newBlobName = `${id}-${Date.now()}${ext}`;
        const blob = blobContainer.getBlockBlobClient(newBlobName);

        const bytes = Buffer.from(fileBase64, "base64");
        await blob.uploadData(bytes, { blobHTTPHeaders: { blobContentType: contentType } });
        newBlobUrl = blob.url;

        // delete old blob (best-effort)
        if (existing.blobName && existing.blobName !== newBlobName) {
          const old = blobContainer.getBlobClient(existing.blobName);
          await old.deleteIfExists().catch(() => {});
        }
      }

      const updated = {
        ...existing,
        ...(title !== undefined ? { title } : {}),
        ...(uploadedBy !== undefined ? { uploadedBy } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(url !== undefined ? { url } : {}),
        blobName: newBlobName,
        blobUrl: newBlobUrl,
        updatedAt: new Date().toISOString(),
      };

      await container.item(id, id).replace(updated);

      return { status: 200, jsonBody: updated };
    } catch (err) {
      context.log("updateVideo error:", err);
      return { status: 500, jsonBody: { error: err.message || String(err) } };
    }
  },
});
