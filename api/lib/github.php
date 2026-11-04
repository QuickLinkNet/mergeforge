<?php

declare(strict_types=1);

// GitHub App user login (web flow). Only the numeric user ID and the login name
// are used; the access token is discarded right after the identity lookup.

function github_http(string $method, string $url, array $headers, ?array $form = null): ?array
{
    $headers[] = 'User-Agent: mergeforge-api';
    $headers[] = 'Accept: application/json';
    $body = $form === null ? null : http_build_query($form);
    if ($body !== null) {
        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
    }

    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        if ($body !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        }
        $text = curl_exec($handle);
        curl_close($handle);
    } else {
        $text = @file_get_contents($url, false, stream_context_create(['http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $body ?? '',
            'timeout' => 15,
            'ignore_errors' => true,
        ]]));
    }
    $decoded = is_string($text) ? json_decode($text, true) : null;
    return is_array($decoded) ? $decoded : null;
}

function github_authorize_url(string $redirectUri, string $state): string
{
    return 'https://github.com/login/oauth/authorize?' . http_build_query([
        'client_id' => config_string('github_client_id'),
        'redirect_uri' => $redirectUri,
        'state' => $state,
    ]);
}

/** @return array{id:int,login:string,token:string}|null */
function github_identity(string $code, string $redirectUri): ?array
{
    $token = github_http('POST', 'https://github.com/login/oauth/access_token', [], [
        'client_id' => config_string('github_client_id'),
        'client_secret' => config_string('github_client_secret'),
        'code' => $code,
        'redirect_uri' => $redirectUri,
    ]);
    $accessToken = $token['access_token'] ?? null;
    if (!is_string($accessToken) || $accessToken === '') {
        return null;
    }
    $user = github_http('GET', 'https://api.github.com/user', ['Authorization: Bearer ' . $accessToken]);
    if (!is_array($user) || !is_int($user['id'] ?? null) || $user['id'] < 1 || !is_string($user['login'] ?? null) || $user['login'] === '') {
        return null;
    }
    return ['id' => $user['id'], 'login' => $user['login'], 'token' => $accessToken];
}

/**
 * True if the user has at least one merged pull request in the project repository,
 * false if not, null if GitHub could not answer (never guess in that case).
 */
function github_is_contributor(string $token, string $login): ?bool
{
    if (preg_match('/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/', $login) !== 1) {
        return false;
    }
    $query = 'repo:' . CONTRIBUTOR_REPO . ' is:pr is:merged author:' . $login;
    $result = github_http('GET', 'https://api.github.com/search/issues?' . http_build_query(['q' => $query, 'per_page' => 1]), ['Authorization: Bearer ' . $token]);
    return is_array($result) && is_int($result['total_count'] ?? null) ? $result['total_count'] > 0 : null;
}
