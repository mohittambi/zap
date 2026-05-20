import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = () => {
  return createSwaggerSpec({
    apiFolder: "src/app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Zap API",
        version: "0.1.0",
        description:
          "Internal Zap API. Auth via JWT (Bearer) or X-API-Key. POST /auth/login to obtain a JWT, then click Authorize and paste it as bearerAuth.",
      },
      servers: [{ url: "/api", description: "Current host" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          apiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });
};
