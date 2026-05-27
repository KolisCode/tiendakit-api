import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto, UpdateProductoDto } from './productos.dto';

@Injectable()
export class ProductosService {
  constructor(private prisma: PrismaService) {}

  findAll(categoriaSlug?: string, minPrecio?: number, maxPrecio?: number) {
    return this.prisma.producto.findMany({
      where: {
        activo: true,
        ...(categoriaSlug && { categoria: { slug: categoriaSlug } }),
        ...(minPrecio !== undefined && { precio: { gte: minPrecio } }),
        ...(maxPrecio !== undefined && { precio: { lte: maxPrecio } }),
      },
      include: { categoria: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(slug: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { slug },
      include: { categoria: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  async findById(id: number) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: { categoria: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  create(dto: CreateProductoDto) {
    const { categoriaId, ...data } = dto;
    return this.prisma.producto.create({
      data: { ...data, categoria: { connect: { id: categoriaId } } },
      include: { categoria: true },
    });
  }

  async update(id: number, dto: UpdateProductoDto) {
    await this.findById(id);
    const { categoriaId, ...data } = dto;
    return this.prisma.producto.update({
      where: { id },
      data: {
        ...data,
        ...(categoriaId && { categoria: { connect: { id: categoriaId } } }),
      },
      include: { categoria: true },
    });
  }

  async remove(id: number) {
    await this.findById(id);
    return this.prisma.producto.delete({ where: { id } });
  }
}
