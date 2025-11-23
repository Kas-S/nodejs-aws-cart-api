import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Cart } from './cart.entity';

@Entity('cart_items')
export class CartItem {
  @PrimaryColumn({ name: 'cart_id', type: 'uuid' })
  cartId: string;

  @PrimaryColumn({ name: 'product_id', type: 'varchar' })
  productId: string;

  @Column({ type: 'integer', default: 1 })
  count: number;

  @ManyToOne(() => Cart, (cart) => cart.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
