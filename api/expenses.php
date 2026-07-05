<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $month = $_GET['month'] ?? date('Y-m'); // 'YYYY-MM'
    $stmt = $pdo->prepare(
        "SELECT id, expense_date, category, amount, note
         FROM expenses
         WHERE DATE_FORMAT(expense_date, '%Y-%m') = ?
         ORDER BY expense_date DESC, id DESC"
    );
    $stmt->execute([$month]);
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $date = $body['expense_date'] ?? null;
    $category = trim($body['category'] ?? '');
    $amount = $body['amount'] ?? null;
    $note = trim($body['note'] ?? '');

    if (!$date || !$category || !is_numeric($amount) || $amount <= 0) {
        json_error('expense_date, category, and a positive numeric amount are required');
    }

    $stmt = $pdo->prepare(
        'INSERT INTO expenses (expense_date, category, amount, note) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$date, $category, $amount, $note ?: null]);

    echo json_encode(['id' => $pdo->lastInsertId()]);
    exit;
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id || !ctype_digit((string)$id)) {
        json_error('a numeric id is required');
    }

    $stmt = $pdo->prepare('DELETE FROM expenses WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode(['deleted' => $stmt->rowCount() > 0]);
    exit;
}

json_error('method not allowed', 405);
