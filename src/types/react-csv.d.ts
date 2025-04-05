declare module "react-csv" {
  import { ComponentType, ReactNode } from "react";

  export interface CSVLinkProps {
    data: any[];
    headers?: Array<{ label: string; key: string }>;
    filename?: string;
    separator?: string;
    target?: string;
    className?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
  }

  export const CSVLink: ComponentType<CSVLinkProps>;
  export const CSVDownload: ComponentType<CSVLinkProps>;
}
