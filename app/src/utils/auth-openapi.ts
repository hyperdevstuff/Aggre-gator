let _schema: Awaited<ReturnType<typeof import("./auth").auth.api.generateOpenAPISchema>> | null = null;

const getSchema = async () => {
  if (_schema) return _schema;
  const authModule = await import("./auth");
  _schema = await authModule.auth.api.generateOpenAPISchema();
  return _schema;
};

export const authOpenAPI = {
  getPaths: (prefix = "/api/auth") =>
    getSchema().then(({ paths }) => {
      const reference: typeof paths = Object.create(null);

      for (const path of Object.keys(paths)) {
        const key = prefix + path;
        reference[key] = paths[path];

        for (const method of Object.keys(paths[path])) {
          const operation = (reference[key] as any)[method];

          operation.tags = ["Better Auth"];
        }
      }

      return reference;
    }),
  components: getSchema().then(({ components }) => components),
} as const;
