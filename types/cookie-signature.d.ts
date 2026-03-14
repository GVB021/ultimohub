declare module "cookie-signature" {
  export function unsign(input: string, secret: string): string | false;
}

