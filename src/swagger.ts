import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "QR Asset BTID - API Documentation",
      version: "1.0.1a",
      description: "IFCA API documentation for the project",
    },
    servers: [
      {
        url: `${process.env.API_SWAGGER_URL}:${process.env.API_SWAGGER_PORT}`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerDocs = swaggerJSDoc(swaggerOptions);

export const setupSwagger = (app: Express) => {
  if (process.env.NODE_ENV !== "production") {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
    console.log("Swagger docs available at /api-docs");
  }
};
