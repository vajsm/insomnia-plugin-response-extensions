const { JSONPath } = require("jsonpath-plus");

module.exports.templateTags = [
  {
    name: "responseExtensions",
    displayName: "Response extensions",
    description: "Reference values (such as headers or OAuth2 token) from other request's responses - extensions",
    args: [
      {
        displayName: "Request",
        type: "model",
        model: "Request",
      },
      {
        displayName: "Attribute",
        type: "enum",
        options: [
          {
            displayName: "OAuth2Token",
            value: "oauth2",
            description: "OAuth2 token details",
          },
          {
            displayName: "Response",
            value: "response",
            description: "Response details and metatada",
          },
        ],
      },
      {
        displayName: "JSONPath filter",
        description:
          "Filters OAuth2 token details object, e.g.for accessToken|refreshToken|identityToken",
        type: "string",
        defaultValue: "$.accessToken",
      },
    ],

    async run(context, id, attribute, filter) {
      if (!id) {
        throw new Error("No request specified");
      }

      filter = filter?.trim();
      if (!filter) {
        throw new Error("No filter specified");
      }

      const request = await context.util.models.request.getById(id);
      if (!request) {
          throw new Error('Could not find request');
      }

      switch (attribute) {
        case "response":
          const environmentId = context.context.getEnvironmentId();
          const response =
            await context.util.models.response.getLatestForRequestId(
              id,
              environmentId
            );

          if (!response) {
            throw new Error("No last response for the selected request");
          }

          if (filter.indexOf("$") === 0) {
            return matchJSONPath(JSON.stringify(response), filter);
          }

        case "oauth2":
          const access = await context.util.models.oAuth2Token.getByRequestId(
            id
          );

          if (!access) {
            throw new Error(
              "No OAuth2Token found for the selected request. Is the authentication mode set to OAuth2?"
            );
          }

          if (filter.indexOf("$") === 0) {
            return matchJSONPath(JSON.stringify(access), filter);
          }
        default:
          throw new Error("Not implemented");
      }
    },
  },
];

/**
 * Source: https://github.com/Kong/insomnia/blob/develop/plugins/insomnia-plugin-response/index.js
 * Author: Kong <office@konghq.com>
 */
function matchJSONPath(bodyStr, query) {
  let body;
  let results;

  try {
    body = JSON.parse(bodyStr);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }

  try {
    results = JSONPath({ json: body, path: query });
  } catch (err) {
    console.error(err);
    throw new Error(`Invalid JSONPath query: ${query}`);
  }

  if (results.length === 0) {
    throw new Error(`Returned no results: ${query}`);
  } else if (results.length > 1) {
    throw new Error(`Returned more than one result: ${query}`);
  }

  if (typeof results[0] !== "string") {
    return JSON.stringify(results[0]);
  } else {
    return results[0];
  }
}
