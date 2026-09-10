import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // GET /  → basic "is the server up?"
  @Get()
  root() {
    return { ok: true, service: 'commute-backend' };
  }

  // GET /health → also checks the database + PostGIS are reachable.
  @Get('health')
  async health() {
    const db = await this.ds.query('SELECT 1 as up');
    const postgis = await this.ds.query('SELECT PostGIS_Version() as version');
    return {
      ok: true,
      db: db[0].up === 1,
      postgis: postgis[0].version,
    };
  }
}