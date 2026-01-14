const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { BlobServiceClient } = require("@azure/storage-blob");

app.http("createVideo", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "videos",
  handler: async (request, context) => {
    try {
      const COSMOS_CONN = process.env.COSMOS_CONN;
      const COSMOS_DB = process.env.COSMOS_DB;
      const COSMOS_CONTAINER = process.env.COSMOS_CONTAINER;
      const BLOB_CONN = process.env.BLOB_CONN;
      const BLOB_CONTAINER = process.env.BLOB_CONTAINER || "videos";

      const body = await request.json().catch(() => ({}));
      const {
        id: idFromBody,
        title,
        uploadedBy = "unknown",
        description = "",
        url = null,
        fileBase64 = null,
        fileName = "video.mp4",
        contentType = "video/mp4",
      } = body;

      if (!title) {
        return { status: 400, jsonBody: { error: "title is required" } };
      }

      const id = idFromBody || `vid-${Date.now()}`;

      let blobName = null;
      let blobUrl = null;

 
      if (fileBase64) {
        if (!BLOB_CONN) {
          return { status: 500, jsonBody: { error: "BLOB_CONN missing" } };
        }
        const blobSvc = BlobServiceClient.fromConnectionString(BLOB_CONN);
        const container = blobSvc.getContainerClient(BLOB_CONTAINER);
        await container.createIfNotExists();

        const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : ".mp4";
        blobName = `${id}${ext}`;
        const blob = container.getBlockBlobClient(blobName);

        const bytes = Buffer.from(fileBase64, "base64");
        await blob.uploadData(bytes, {
          blobHTTPHeaders: { blobContentType: contentType },
        });

        blobUrl = blob.url;
      }

      if (!COSMOS_CONN || !COSMOS_DB || !COSMOS_CONTAINER) {
        return { status: 500, jsonBody: { error: "Cosmos env vars missing" } };
      }

      const cosmos = new CosmosClient(COSMOS_CONN);
      const container = cosmos.database(COSMOS_DB).container(COSMOS_CONTAINER);

      const doc = {
        id,
        title,
        uploadedBy,
        description,
        
        url,
        blobName,
        blobUrl,
        createdAt: new Date().toISOString(),
      };

      await container.items.create(doc);

      return { status: 201, jsonBody: doc };
    } catch (err) {
      context.log("createVideo error:", err);
      return { status: 500, jsonBody: { error: err.message || String(err) } };
    }
  },
});
