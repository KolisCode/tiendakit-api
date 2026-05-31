import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProductosService } from '../productos/productos.service';
import { CreateOrdenDto, EstadoOrden } from './ordenes.dto';
import MercadoPagoConfig, { Preference, Payment } from 'mercadopago';

@Injectable()
export class OrdenesService {
  private readonly logger = new Logger(OrdenesService.name);
  private mp: MercadoPagoConfig;

  constructor(
    private prisma: PrismaService,
    private productosService: ProductosService,
  ) {
    this.mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }

  async crear(dto: CreateOrdenDto, baseUrl: string) {
    const productosConCantidad = await Promise.all(
      dto.items.map(async (item) => {
        const producto = await this.productosService.findById(item.productoId);
        if (!producto.activo) {
          throw new ConflictException(`${producto.nombre} ya no está disponible`);
        }
        if (producto.stock < item.cantidad) {
          throw new BadRequestException(`Stock insuficiente para ${producto.nombre}`);
        }
        return { producto, cantidad: item.cantidad };
      }),
    );

    const total = productosConCantidad.reduce(
      (sum, { producto, cantidad }) => sum + Number(producto.precio) * cantidad,
      0,
    );

    const orden = await this.prisma.orden.create({
      data: {
        nombreComprador: dto.nombreComprador,
        emailComprador: dto.emailComprador,
        telefonoComprador: dto.telefonoComprador,
        total,
        items: {
          create: productosConCantidad.map(({ producto, cantidad }) => ({
            productoId: producto.id,
            cantidad,
            precio: producto.precio,
          })),
        },
      },
      include: { items: { include: { producto: { include: { categoria: true } } } } },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const apiUrl = process.env.API_URL ?? baseUrl;

    const preference = new Preference(this.mp);
    let mpResponse: Awaited<ReturnType<typeof preference.create>>;
    try {
      mpResponse = await preference.create({
        body: {
          items: productosConCantidad.map(({ producto, cantidad }) => ({
            id: String(producto.id),
            title: producto.nombre,
            quantity: cantidad,
            unit_price: Number(producto.precio),
            currency_id: 'COP',
          })),
          payer: {
            name: dto.nombreComprador,
            email: dto.emailComprador,
          },
          back_urls: {
            success: `${frontendUrl}/orden/confirmacion?ordenId=${orden.id}&estado=pagado`,
            failure: `${frontendUrl}/orden/confirmacion?ordenId=${orden.id}&estado=cancelado`,
            pending: `${frontendUrl}/orden/confirmacion?ordenId=${orden.id}&estado=pendiente`,
          },
          auto_return: 'approved',
          external_reference: String(orden.id),
          notification_url: `${apiUrl}/api/ordenes/webhook`,
        },
      });
    } catch (err: any) {
      this.logger.error('MercadoPago error', err?.message ?? err);
      throw new InternalServerErrorException(
        err?.message ?? 'Error al crear la preferencia de pago',
      );
    }

    await this.prisma.orden.update({
      where: { id: orden.id },
      data: { mpPreferenceId: mpResponse.id },
    });

    return { orden, initPoint: mpResponse.init_point };
  }

  async procesarWebhook(tipo: string, paymentId: string | undefined) {
    if (tipo !== 'payment' || !paymentId) return;

    const payment = new Payment(this.mp);
    const mpPayment = await payment.get({ id: paymentId });

    const ordenId = Number(mpPayment.external_reference);
    if (!ordenId) return;

    const orden = await this.prisma.orden.findUnique({ where: { id: ordenId } });
    if (!orden) return;

    if (mpPayment.status === 'approved') {
      if (orden.estado === 'PAGADO') return;

      await this.prisma.orden.update({
        where: { id: ordenId },
        data: { estado: 'PAGADO', mpPaymentId: paymentId },
      });

      const items = await this.prisma.itemOrden.findMany({ where: { ordenId } });
      await Promise.all(
        items.map(async (item) => {
          const result = await this.prisma.producto.updateMany({
            where: { id: item.productoId, stock: { gte: item.cantidad } },
            data: { stock: { decrement: item.cantidad } },
          });
          if (result.count === 0) {
            this.logger.warn(
              `Stock insuficiente al decrementar producto ${item.productoId} en orden ${ordenId} — revisar manualmente`,
            );
          }
        }),
      );
    } else if (mpPayment.status === 'cancelled' || mpPayment.status === 'rejected') {
      await this.prisma.orden.update({
        where: { id: ordenId },
        data: { estado: 'CANCELADO' },
      });
    }
  }

  findAll(soloNoPagadas?: boolean) {
    return this.prisma.orden.findMany({
      where: soloNoPagadas ? { estado: 'PENDIENTE' } : undefined,
      include: { items: { include: { producto: { include: { categoria: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const orden = await this.prisma.orden.findUnique({
      where: { id },
      include: { items: { include: { producto: { include: { categoria: true } } } } },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    return orden;
  }

  async actualizarEstado(id: number, estado: EstadoOrden) {
    await this.findOne(id);
    return this.prisma.orden.update({ where: { id }, data: { estado } });
  }

  verificarFirmaWebhook(dataId: string | undefined, xSignature: string | undefined): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret || secret === 'tu-webhook-secret') return true;
    if (!xSignature || !dataId) return false;

    const parts: Record<string, string> = {};
    xSignature.split(',').forEach((part) => {
      const idx = part.indexOf('=');
      if (idx !== -1) parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    });

    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-date:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  estadisticas() {
    return this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC('day', "createdAt") AS dia,
        CAST(COUNT(*) AS INT) AS total_ordenes,
        SUM(total) AS ingresos
      FROM "Orden"
      WHERE estado = 'PAGADO'
        AND "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY dia
      ORDER BY dia DESC
    `;
  }
}
