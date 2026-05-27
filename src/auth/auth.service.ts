import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './auth.dto';

const DUMMY_HASH = '$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({ where: { email: dto.email } });
    const hash = admin?.password ?? DUMMY_HASH;
    const valid = await bcrypt.compare(dto.password, hash);

    if (!admin || !valid) throw new UnauthorizedException('Credenciales inválidas');

    const token = this.jwt.sign({ sub: admin.id, email: admin.email });
    return { access_token: token };
  }

  async crearAdmin(email: string, nombre: string, password: string) {
    const hash = await bcrypt.hash(password, 12);
    return this.prisma.admin.create({ data: { email, nombre, password: hash } });
  }
}
