import { authenticator } from '~/utils/auth.server';
import { LoaderFunction } from '@remix-run/node';

export const loader: LoaderFunction = async ({ request }) => {
    return await authenticator.authenticate('google', request, {
        successRedirect: '/',
        failureRedirect: '/login',
    });
};