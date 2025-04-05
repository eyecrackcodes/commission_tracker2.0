declare module "react-csv" {
  import { ComponentType } from "react";

  export interface CSVLinkProps {
    data: any[];
    headers?: any[];
    filename?: string;
    separator?: string;
    target?: string;
    className?: string;
    style?: React.CSSProperties;
  }

  export const CSVLink: ComponentType<CSVLinkProps>;
  export const CSVDownload: ComponentType<CSVLinkProps>;
}
