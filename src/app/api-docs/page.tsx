"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import "./swagger-dark.css";

export default function ApiDocsPage() {
  return (
    <main className="swagger-page">
      <SwaggerUI url="/api/api-docs" />
    </main>
  );
}
