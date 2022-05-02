import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly UsersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // create a new user
  @Post()
  async addUser(
    @Body('name') name: string,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    if (!name || !email || !password) {
      throw new NotFoundException('Incorrect data');
    }

    const status = await this.UsersService.insertUser(name, email, password);
    return status;
  }

  // login user and return jwt token
  @Get()
  async getUser(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    if (!email || !password) {
      throw new NotFoundException('Email and password are required.');
    }

    const jwt = await this.jwtService.signAsync({ email, password });
    const details = await this.UsersService.getUser(email, password);
    return { details, jwt };
  }

  // request reset password
  @Get('/forgot')
  async forgotPassword(@Body('email') email: string) {
    if (!email) {
      throw new NotFoundException('Email is required.');
    }
    const status = await this.UsersService.forgotPass(email);
    return status;
  }

  // Verify url if it is valid or not
  @Get('/reset/:token')
  async verifyResetPassword(@Param('token') token: string) {
    if (!token) {
      throw new NotFoundException('Bad Request');
    }
    const status = await this.UsersService.verifyResetPass(token);
    return status;
  }

  // set the new password
  @Post('/reset/:token')
  async resetPassword(
    @Param('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!token || !newPassword) {
      throw new NotFoundException('Bad Request');
    }
    const status = await this.UsersService.resetPass(token, newPassword);
    return status;
  }
}
