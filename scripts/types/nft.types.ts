export interface NftAttribute {
  trait_type: string;
  value: string;
}

export interface NftFile {
  uri: string;
  type: string;
}

export interface NftCreator {
  address: string;
  share: number;
}

export interface NftProperties {
  files: NftFile[];
  category: string;
  creators: NftCreator[];
}

export interface NftMetadata {
  name: string;
  symbol: string;
  description: string;
  seller_fee_basis_points: number;
  image: string;
  attributes: NftAttribute[];
  properties: NftProperties;
} 