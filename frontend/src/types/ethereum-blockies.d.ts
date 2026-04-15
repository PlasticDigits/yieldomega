// SPDX-License-Identifier: AGPL-3.0-only

declare module "ethereum-blockies" {
  const blockies: {
    create(opts: {
      seed: string;
      size?: number;
      scale?: number;
      color?: string;
      bgcolor?: string;
      spotcolor?: string;
    }): HTMLCanvasElement;
  };
  export default blockies;
}
