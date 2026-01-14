const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { BlobServiceClient } = require("@azure/storage-blob");

app.http("deleteVideo", {
  methods: ["DELETE"],
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

      const cosmos = new CosmosClient(COSMOS_CONN);
      const container = cosmos.database(COSMOS_DB).container(COSMOS_CONTAINER);

      const { resource } = await container.item(id, id).read();
      if (!resource) return { status: 404, jsonBody: { error: "Not found" } };

      
      await container.item(id, id).delete();

      
      if (resource.blobName && BLOB_CONN) {
        const blobSvc = BlobServiceClient.fromConnectionString(BLOB_CONN);
        const blobContainer = blobSvc.getContainerClient(BLOB_CONTAINER);
        const blob = blobContainer.getBlobClient(resource.blobName);
        await blob.deleteIfExists().catch(() => {});
      }

      return { status: 200, jsonBody: { ok: true, deletedId: id } };
    } catch (err) {
      context.log("deleteVideo error:", err);
      return { status: 500, jsonBody: { error: err.message || String(err) } };
    }
  },
});
