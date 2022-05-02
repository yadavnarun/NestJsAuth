import { Injectable, NotFoundException, HttpException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { MailerService } from '@nestjs-modules/mailer';

import { User } from './user.model';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<User>,
    private readonly mailerService: MailerService,
    private readonly jwtService: JwtService,
  ) {}

  // insert a new user
  async insertUser(name: string, email: string, password: string) {
    // verify users if already exists
    let user: User & { _id: any };
    try {
      user = await this.userModel.findOne({ email: email }).exec();
    } catch (error) {
      throw new HttpException('Internal Server error', 500);
    }

    if (!user) {
      // insert new user
      const hashed = await bcrypt.hash(password, 10); // hash password
      const newUser = new this.userModel({
        name,
        email,
        password: hashed,
      });

      const result = await newUser.save();
      return result.id as string;
    } else {
      throw new HttpException('User already exists', 409);
    }
  }

  // get a user by email and verify password
  async getUser(email: string, password: string) {
    let user: User & { _id: any };
    try {
      user = await this.userModel.findOne({ email: email }).exec();
    } catch (error) {
      throw new NotFoundException('Could not find user.');
    }
    if (!user) {
      throw new NotFoundException('Could not find user.');
    }
    if (await bcrypt.compare(user.password, password)) {
      throw new NotFoundException('Incorrect password.');
    }

    return { email: user.email, name: user.name };
  }

  // forgot password get email and send email with token
  async forgotPass(email: string) {
    let user: User & { _id: any };
    try {
      user = await this.userModel.findOne({ email: email }).exec();
    } catch (error) {
      throw new NotFoundException('Could not find user.');
    }
    if (!user) throw new NotFoundException('Could not find user.');

    const payload = {
      email: user.email,
      name: user.name,
      secret: user._id + user.password,
    };

    const token = await this.jwtService.signAsync(payload);
    const sent = await this.sendMail(email, token)
      .then(() => true)
      .catch(() => false);

    return { sent };
  }

  // verify url token
  async verifyResetPass(token: string) {
    const key = await this.jwtService.verifyAsync(token).catch(() => {
      throw new NotFoundException('Bad request');
    });

    let user: User & { _id: any };
    try {
      user = await this.userModel.findOne({ email: key.email }).exec();
    } catch (error) {
      throw new NotFoundException('Bad request');
    }
    if (!user) throw new NotFoundException('Bad request');
    if (user._id + user.password !== key.secret)
      throw new NotFoundException('Bad request');
    if (Date.now() >= key.exp * 1000)
      throw new NotFoundException('Token Expired');

    return { ok: true };
  }

  // reset password with token
  async resetPass(token: string, password: string) {
    const key = await this.jwtService.verifyAsync(token).catch(() => {
      throw new NotFoundException('Bad request');
    });

    let user: User & { _id: any };
    try {
      user = await this.userModel.findOne({ email: key.email }).exec();
    } catch (error) {
      throw new NotFoundException('Bad request');
    }
    if (!user) throw new NotFoundException('Bad request');
    if (user._id + user.password !== key.secret)
      throw new NotFoundException('Bad request');
    if (Date.now() >= key.exp * 1000)
      throw new NotFoundException('Token Expired');

    const hashed = await bcrypt.hash(password, 10); // hash new password

    user.password = hashed;
    await user.save().catch(() => {
      throw new NotFoundException('Bad request');
    });

    return { ok: true };
  }

  // send email with token
  async sendMail(email: string, token: string) {
    const url = `http://localhost:3000/users/reset/${token}`;
    console.log('Enter This URL in Postman', url);

    await this.mailerService.sendMail({
      from: 'noreply@domain.com',
      to: email,
      subject: 'Reset Password',
      text: `Password reset link ${url}`,
      html: `<p>Password reset <a href=${url}>reset link</a></p>`,
    });
  }
}
