declare module "react-csv" {
  import { PropsWithChildren } from "react";

  export interface CSVLinkProps {
    data: any[];
    headers?: Array<{ label: string; key: string }>;
    filename?: string;
    separator?: string;
    target?: string;
    className?: string;
    style?: React.CSSProperties;
  }

  export const CSVLink: React.ComponentType<PropsWithChildren<CSVLinkProps>>;
  export const CSVDownload: React.ComponentType<
    PropsWithChildren<CSVLinkProps>
  >;
}
