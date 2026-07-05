<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT id, category, monthly_limit FROM budgets ORDER BY category');
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $category = trim($body['category'] ?? '');
    $limit = $body['monthly_limit'] ?? null;

    if (!$category || !is_numeric($limit) || $limit < 0) {
        json_error('category and a non-negative numeric monthly_limit are required');
    }

    $stmt = $pdo->prepare(
        'INSERT INTO budgets (category, monthly_limit) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit)'
    );
    $stmt->execute([$category, $limit]);

    echo json_encode(['ok' => true]);
    exit;
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id || !ctype_digit((string)$id)) {
        json_error('a numeric id is required');
    }

    $stmt = $pdo->prepare('DELETE FROM budgets WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode(['deleted' => $stmt->rowCount() > 0]);
    exit;
}

json_error('method not allowed', 405);
