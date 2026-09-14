import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import { ApiKeyGuard } from '../common/api-key.guard';

// Both routes require the app's x-api-key (same key the app already sends).
@Controller('volunteers')
@UseGuards(ApiKeyGuard)
export class VolunteersController {
  constructor(private readonly volunteers: VolunteersService) {}

  // POST /volunteers/signup  { name, phone?, city? }  → { code, ... }
  @Post('signup')
  signup(@Body() body: any) {
    return this.volunteers.signup(body ?? {});
  }

  // POST /volunteers/login   { code }  → { code, name, phone, city, createdAt }
  @Post('login')
  login(@Body() body: any) {
    return this.volunteers.login(body ?? {});
  }
}