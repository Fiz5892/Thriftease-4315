import { authenticator } from '~/utils/auth.server';
import { ActionFunction, LoaderFunction, redirect } from '@remix-run/node';

export const loader: LoaderFunction = () => redirect('/login');

export const action: ActionFunction = async ({ request }) => {
    return await authenticator.authenticate('google', request, {
        successRedirect: '/',
        failureRedirect: '/login',
    });
};