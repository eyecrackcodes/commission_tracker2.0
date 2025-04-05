declare module "react-csv" {
  import { ReactNode } from "react";

  export interface CSVLinkProps {
    data: any[];
    headers?: Array<{ label: string; key: string }>;
    filename?: string;
    separator?: string;
    target?: string;
    className?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
    onClick?: () => void;
  }

  export const CSVLink: (props: CSVLinkProps) => JSX.Element;
  export const CSVDownload: (props: CSVLinkProps) => JSX.Element;
}
