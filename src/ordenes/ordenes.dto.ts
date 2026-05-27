import { IsString, IsEmail, IsOptional, IsArray, ValidateNested, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
  @ValidateNested({ each: true })
  @Type(() => ItemOrdenDto)
  items: ItemOrdenDto[];
}

export class WebhookMpDto {
  type: string;
  data: { id: string };
}
