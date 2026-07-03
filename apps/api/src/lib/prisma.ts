import { PrismaClient } from "@prisma/client";

// Single shared client. Prisma's connection pool already handles reuse;
// creating a new client per request would exhaust DB connections.
export const prisma = new PrismaClient({
  // Never log query params — OAuth tokens and lead PII can flow through
  // query args, and Prisma's "query" log level includes them verbatim.
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
