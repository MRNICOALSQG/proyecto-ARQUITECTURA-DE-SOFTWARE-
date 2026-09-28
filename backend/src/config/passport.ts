import { PassportStatic } from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { query } from './database';

export function configurePassport(passport: PassportStatic): void {
  const opts: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromExtractors([
      ExtractJwt.fromAuthHeaderAsBearerToken(),
      ExtractJwt.fromUrlQueryParameter('token')
    ]),
    secretOrKey: process.env.JWT_SECRET || 'fallback-secret',
    algorithms: ['HS256'],
  };

  passport.use(
    new JwtStrategy(opts, async (payload, done) => {
      try {
        // Check if token is revoked
        const revoked = await query(
          'SELECT id FROM revoked_tokens WHERE token_jti = $1',
          [payload.jti]
        );
        if (revoked.rows.length > 0) {
          return done(null, false);
        }

        // Find user
        const result = await query(
          'SELECT id, email, username, created_at FROM users WHERE id = $1',
          [payload.sub]
        );

        if (result.rows.length === 0) {
          return done(null, false);
        }

        return done(null, result.rows[0]);
      } catch (error) {
        return done(error, false);
      }
    })
  );
}
