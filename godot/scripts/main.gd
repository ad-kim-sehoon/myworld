extends Node2D

# 간단한 플레이어 이동: 클릭/터치로 목표 지정, 키보드로 이동
@onready var player := $Player
var speed := 200.0
var target: Vector2 = null

func _input(event) -> void:
  if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
    target = get_global_mouse_position()

func _physics_process(delta: float) -> void:
  if target != null:
    var dir := target - player.global_position
    if dir.length() < 8.0:
      player.velocity = Vector2.ZERO
      target = null
    else:
      player.velocity = dir.normalized() * speed
      player.move_and_slide()
  else:
    player.velocity = Vector2.ZERO
    player.move_and_slide()
