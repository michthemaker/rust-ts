export interface Debug {
  [FMT](
    depth: number,
    options: FmtOptions,
    inspect: (arg: any, options: FmtOptions) => string,
  ): string;
}

export type FmtOptions = {
  /**
   * Whether to colorize the output
   */
  colors?: boolean;
  /**
   * The depth of the inspection
   */
  depth?: number;
};

export const FMT = Symbol.for("nodejs.util.inspect.custom");
