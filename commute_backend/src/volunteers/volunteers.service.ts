import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class VolunteersService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /// Create a volunteer and assign them a code (A-<id>). Returns their info.
  async signup(input: { name?: string; phone?: string; city?: string }) {
    const name = (input?.name ?? '').trim();
    if (!name) throw new BadRequestException('Name is required.');
    const phone = input?.phone?.trim() || null;
    const city = input?.city?.trim() || 'Delhi';

    // Insert to get the auto id, then derive the human code from it. One
    // transaction so a row never exists without a code.
    const code = await this.ds.transaction(async (m) => {
      const inserted = await m.query(
        `INSERT INTO volunteers (name, phone, city) VALUES ($1, $2, $3) RETURNING id`,
        [name, phone, city],
      );
      const id = inserted[0].id;
      const newCode = `A-${id}`;
      await m.query(`UPDATE volunteers SET code = $1 WHERE id = $2`, [newCode, id]);
      return newCode;
    });

    return { code, name, phone, city };
  }

  /// Look up a volunteer by code (the "login"). 404 if the code is unknown.
  async login(input: { code?: string }) {
    const code = (input?.code ?? '').trim();
    if (!code) throw new BadRequestException('Code is required.');
    const rows = await this.ds.query(
      `SELECT code, name, phone, city, created_at
         FROM volunteers WHERE code = $1 LIMIT 1`,
      [code],
    );
    if (rows.length === 0) {
      throw new NotFoundException('No volunteer found with that code.');
    }
    const v = rows[0];
    return {
      code: v.code,
      name: v.name,
      phone: v.phone,
      city: v.city,
      createdAt: v.created_at,
    };
  }
}