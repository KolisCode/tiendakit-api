import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrdenesService } from './ordenes.service';
import { CreateOrdenDto, WebhookMpDto } from './ordenes.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ordenes')
export class OrdenesController {
  constructor(private service: OrdenesService) {}

  @Post()
  crear(@Body() dto: CreateOrdenDto, @Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.service.crear(dto, baseUrl);
  }

  @Post('webhook')
  webhook(@Body() body: WebhookMpDto) {
    return this.service.procesarWebhook(body.type, body.data?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('pendientes') pendientes?: string) {
    return this.service.findAll(pendientes === 'true');
  }

  @UseGuards(JwtAuthGuard)
  @Get('estadisticas')
  estadisticas() {
    return this.service.estadisticas();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/estado')
  actualizarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: string,
  ) {
    return this.service.actualizarEstado(id, estado);
  }
}
