export class CartItemDto {
  product_id: string;
  count: number;
}

export class CartDto {
  id: string;
  user_id: string;
  status: string;
  items: CartItemDto[];
  created_at: Date;
  updated_at: Date;
}
