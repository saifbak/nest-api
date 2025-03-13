import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon from 'argon2';

import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signup(dto: AuthDto) {
    // First hash the Password
    const hash = await argon.hash(dto.password);
    try {
      // Save the new User
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          hash,
        },
      });
      // Return the saved User
      // delete user.hash;
      return this.loginToken(user.id, user.email);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Credentials already exists');
        }
        throw error;
      }
    }
  }

  async login(dto: AuthDto) {
    //find the user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    //if user does not exist throw exception
    if (!user) throw new ForbiddenException('User doest not exist!');

    //compare the password
    const pwMatches = await argon.verify(user.hash, dto.password);

    //if the password incorrect throw exception
    if (!pwMatches) throw new ForbiddenException('Incorrect password');

    //send back the user
    // delete user.hash;
    return this.loginToken(user.id, user.email);
  }

  async loginToken(
    userId: number,
    email: string,
  ): Promise<{ access_token: string; email: string }> {
    const payload = {
      sub: userId,
      email,
    };

    const secret = this.config.get('JWT_SECRET_KEY');

    const token: string = await this.jwt.signAsync(payload, {
      expiresIn: '15m',
      secret: secret,
    });

    return {
      access_token: token,
      email: email,
    };
  }
}
