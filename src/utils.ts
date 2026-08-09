import isEmpty from "just-is-empty";

export const hasThreadToWatch = (env: Env): boolean => {
  return !isEmpty(env.TARGET.values);
}

