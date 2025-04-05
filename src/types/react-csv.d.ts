declare module "react-csv" {
  export interface CSVLinkProps {
    data: string | object[];
    headers?: { label: string; key: string }[];
    separator?: string;
    filename?: string;
    className?: string;
    onClick?: () => void;
    children?: React.ReactNode;
  }

  export const CSVLink: React.FC<CSVLinkProps>;
  export default CSVLink;
}
