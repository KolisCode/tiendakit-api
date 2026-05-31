import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto, UpdateProductoDto } from './productos.dto';

@Injectable()
export class ProductosService {
  constructor(private prisma: PrismaService) {}

  findAll(
    categoriaSlug?: string,
    minPrecio?: number,
    maxPrecio?: number,
    incluirInactivos = false,
    q?: string,
    sort?: string,
  ) {
    const orderBy: any =
      sort === 'precio_asc'  ? { precio: 'asc' }  :
      sort === 'precio_desc' ? { precio: 'desc' } :
      { createdAt: 'desc' };

    return this.prisma.producto.findMany({
      where: {
        ...(!incluirInactivos && { activo: true }),
        ...(categoriaSlug && { categoria: { slug: categoriaSlug } }),
        ...((minPrecio !== undefined || maxPrecio !== undefined) && {
          precio: {
            ...(minPrecio !== undefined && { gte: minPrecio }),
            ...(maxPrecio !== undefined && { lte: maxPrecio }),
          },
        }),
        ...(q && {
          OR: [
            { nombre:      { contains: q, mode: 'insensitive' } },
            { descripcion: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      include: { categoria: true },
      orderBy,
    });
  }

  async findOne(slug: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { slug, activo: true },
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

  async create(dto: CreateProductoDto) {
    const { categoriaId, ...data } = dto;
    try {
      return await this.prisma.producto.create({
        data: { ...data, categoria: { connect: { id: categoriaId } } },
        include: { categoria: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Ya existe un producto con ese slug');
      throw e;
    }
  }

  async update(id: number, dto: UpdateProductoDto) {
    await this.findById(id);
    const { categoriaId, ...data } = dto;
    try {
      return await this.prisma.producto.update({
        where: { id },
        data: {
          ...data,
          ...(categoriaId && { categoria: { connect: { id: categoriaId } } }),
        },
        include: { categoria: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Ya existe un producto con ese slug');
      throw e;
    }
  }

  async remove(id: number) {
    await this.findById(id);
    try {
      return await this.prisma.producto.delete({ where: { id } });
    } catch (e: any) {
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new ConflictException('No se puede eliminar: el producto tiene órdenes asociadas');
      }
      throw e;
    }
  }
}
