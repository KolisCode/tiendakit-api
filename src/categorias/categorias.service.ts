import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoriaDto, UpdateCategoriaDto } from './categorias.dto';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
  }

  async create(dto: CreateCategoriaDto) {
    try {
      return await this.prisma.categoria.create({ data: dto });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Ya existe una categoría con ese nombre o slug');
      throw e;
    }
  }

  async update(id: number, dto: UpdateCategoriaDto) {
    try {
      return await this.prisma.categoria.update({ where: { id }, data: dto });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Ya existe una categoría con ese nombre o slug');
      throw e;
    }
  }

  async remove(id: number) {
    try {
      return await this.prisma.categoria.delete({ where: { id } });
    } catch (e: any) {
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new ConflictException('No se puede eliminar: la categoría tiene productos asociados');
      }
      throw e;
    }
  }
}
