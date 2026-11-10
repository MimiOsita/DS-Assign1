import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
  const body = parseJsonObject(event);
  if (isResponse(body)) return body;

  if (
    typeof body.movieId !== "number" ||
    typeof body.actorId !== "number" ||
    typeof body.roleName !== "string" ||
    typeof body.roleDescription !== "string" ||
    body.roleName.trim() === ""
  ) {
    return response(400, {
      message: "Invalid body parameters. Missing or malformed schema properties."
    });
  }

  const role: Role = {
    movieId: body.movieId,
    actorId: body.actorId,
    roleName: body.roleName,
    roleDescription: body.roleDescription,
  };

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          ConditionCheck: {
            TableName: tableName,
            Key: {
              PK: movieKey(role.movieId), 
              SK: movieKey(role.movieId)
            },
            ConditionExpression: "attribute_exists(PK)",
          },
        },
        {
          ConditionCheck: {
            TableName: tableName,
            Key: {
              PK: actorKey(role.actorId),
              SK: actorKey(role.actorId)
            },
            ConditionExpression: "attribute_exists(PK)",
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: movieKey(role.movieId),
              SK: actorKey(role.actorId),
              ...role,
            },
          },
        },
      ],
    })
  );

    //  TOD∏O - Add role if its IDs are valid
    return response(201, { message: "Role added", data: role });
  } catch (err: any) {
    console.error("DynamoDB error:", err);

    if (err.name === "TransactionCanceledException") {
      return response(400, {
        message: "Transaction Aborted. The reference movieID or actorID target could not be verified in the database.",
      });
    }
    return response(500, {
      message: "Internal server error",
      error: err.message || err,
    });
  }
};
