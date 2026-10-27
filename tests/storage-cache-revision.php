<?php
/** Exercise the actual cache function with a synthetic revisioned database. */
declare(strict_types=1);
$source = file_get_contents(__DIR__.'/../lib/storage.php');
$start = strpos($source, 'function ghadir_mysql_db(');
$end = strpos($source, "\nfunction ghadir_db(", $start);
$function = substr($source, $start, $end-$start);
$function = str_replace(['ghadir_mysql_pdo()', 'ghadir_mysql_bootstrap($pdo)'], ['fixture_pdo()', 'fixture_bootstrap($pdo)'], $function);
function ghadir_state_prepare(array &$s): void {}
function fail($message, $status): never {throw new RuntimeException($message);}
function fixture_bootstrap($pdo): void {}
class FixtureResult {
    public function __construct(private array $row) {}
    public function fetch(): array {return $this->row;}
    public function fetchColumn(): int {return $this->row['revision'];}
}
class FixtureStatement {
    public function __construct(private FixtureDatabase $db, private string $sql) {}
    public function execute(array $args): void {
        if (str_starts_with($this->sql, 'UPDATE')) {$this->db->raw=$args[0];$this->db->revision=$args[1];}
    }
}
class FixtureDatabase {
    public int $revision=1;
    public int $loads=0;
    public string $raw='{"inventory":[{"serial":"SYNTHETIC","qty":7}]}';
    public function query(string $sql): FixtureResult {
        if (str_contains($sql, 'state_json')) $this->loads++;
        return new FixtureResult(['revision'=>$this->revision,'state_json'=>$this->raw]);
    }
    public function prepare(string $sql): FixtureStatement {return new FixtureStatement($this,$sql);}
    public function beginTransaction(): void {}
    public function commit(): void {}
    public function inTransaction(): bool {return false;}
}
function fixture_pdo(): FixtureDatabase {static $db;return $db??=new FixtureDatabase();}
function verify(bool $condition, string $message): void {if (!$condition) throw new RuntimeException($message);}
eval($function);
$read=fn($s)=>$s['inventory'][0]['qty'];
verify(ghadir_mysql_db(false,$read)===7,'First read failed');
verify(ghadir_mysql_db(false,$read)===7 && fixture_pdo()->loads===1,'Same revision decoded twice');
ghadir_mysql_db(false,function(&$s){$s['inventory'][0]['qty']=999;});
verify(ghadir_mysql_db(false,$read)===7,'Read callback contaminated snapshot');
fixture_pdo()->revision=2;
fixture_pdo()->raw='{"inventory":[{"serial":"SYNTHETIC","qty":8}]}';
verify(ghadir_mysql_db(false,$read)===8 && fixture_pdo()->loads===2,'Revision change did not invalidate');
ghadir_mysql_db(true,function(&$s){$s['inventory'][0]['qty']=9;});
verify(ghadir_mysql_db(false,$read)===9 && fixture_pdo()->loads===3,'Read after write was stale');
echo "Storage cache revision behavior passed\n";
