import { IsString, IsEmail, IsOptional, IsArray, ArrayMinSize, ValidateNested, IsInt, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum EstadoOrden {
  PENDIENTE = 'PENDIENTE',
  PAGADO = 'PAGADO',
  ENVIADO = 'ENVIADO',
  CANCELADO = 'CANCELADO',
}

export class ItemOrdenDto {
  @IsInt()
  @Type(() => Number)
  productoId: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  cantidad: number;
}

export class CreateOrdenDto {
  @IsString()
  nombreComprador: string;

  @IsEmail()
  emailComprador: string;

  @IsOptional()
  @IsString()
  telefonoComprador?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemOrdenDto)
  items: ItemOrdenDto[];
}

export class ActualizarEstadoDto {
  @IsEnum(EstadoOrden)
  estado: EstadoOrden;
}

export class WebhookMpDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  data?: { id?: string };
}
