package com.example.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.ChartPoint
import com.example.ui.theme.BgBlack
import com.example.ui.theme.BorderSubtle
import com.example.ui.theme.DangerBorder
import com.example.ui.theme.DangerDim
import com.example.ui.theme.DangerText
import com.example.ui.theme.Lime
import com.example.ui.theme.LimeBorder
import com.example.ui.theme.LimeDim
import com.example.ui.theme.Surface1
import com.example.ui.theme.Surface2
import com.example.ui.theme.Surface3
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import kotlin.math.roundToInt

@Composable
fun IronCard(
    modifier: Modifier = Modifier,
    highlight: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(14.dp)
    val border = BorderStroke(1.dp, if (highlight) LimeBorder else BorderSubtle)
    val mod = modifier
        .fillMaxWidth()
        .clip(shape)
        .then(
            if (highlight) {
                Modifier.background(
                    Brush.verticalGradient(listOf(Color(0x14A3E635), Surface1))
                )
            } else {
                Modifier.background(Surface1)
            }
        )
        .border(border, shape)
        .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
        .padding(14.dp)

    Column(modifier = mod, content = content)
}

@Composable
fun IronBadge(
    text: String,
    accent: Boolean = false,
    danger: Boolean = false
) {
    val bg = when {
        danger -> DangerDim
        accent -> LimeDim
        else -> Surface2
    }
    val border = when {
        danger -> DangerBorder
        accent -> LimeBorder
        else -> BorderSubtle
    }
    val fg = when {
        danger -> DangerText
        accent -> Lime
        else -> TextMuted
    }
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = bg,
        border = BorderStroke(1.dp, border)
    ) {
        Text(
            text = text.uppercase(),
            color = fg,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier) {
    Text(
        text = title.uppercase(),
        color = TextMuted,
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = 0.8.sp,
        modifier = modifier.padding(top = 12.dp, bottom = 6.dp)
    )
}

@Composable
fun IronPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    compact: Boolean = false
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(11.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Lime,
            contentColor = BgBlack,
            disabledContainerColor = Surface3,
            disabledContentColor = TextMuted
        ),
        contentPadding = if (compact) PaddingValues(horizontal = 12.dp, vertical = 8.dp)
        else PaddingValues(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Text(text = text, fontWeight = FontWeight.Bold, fontSize = if (compact) 13.sp else 14.sp)
    }
}

@Composable
fun IronSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    danger: Boolean = false,
    compact: Boolean = false
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, if (danger) DangerBorder else BorderSubtle),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (danger) DangerDim else Surface2,
            contentColor = if (danger) DangerText else TextPrimary
        ),
        contentPadding = if (compact) PaddingValues(horizontal = 11.dp, vertical = 7.dp)
        else PaddingValues(horizontal = 14.dp, vertical = 11.dp)
    ) {
        Text(text = text, fontWeight = FontWeight.Bold, fontSize = if (compact) 12.sp else 13.sp)
    }
}

@Composable
fun IronTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    singleLine: Boolean = true,
    visualTransformation: VisualTransformation = VisualTransformation.None
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            color = TextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 5.dp)
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = if (placeholder.isNotEmpty()) {
                { Text(placeholder, color = Color(0xFF52525B)) }
            } else null,
            singleLine = singleLine,
            visualTransformation = visualTransformation,
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Lime,
                unfocusedBorderColor = BorderSubtle,
                focusedContainerColor = Surface2,
                unfocusedContainerColor = Surface2,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
                cursorColor = Lime
            ),
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
fun StatBox(
    label: String,
    value: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    accentValue: Boolean = false
) {
    IronCard(modifier = modifier) {
        Text(
            text = label.uppercase(),
            color = TextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = value,
            color = if (accentValue) Lime else TextPrimary,
            fontSize = 20.sp,
            fontWeight = FontWeight.Black
        )
        Spacer(Modifier.height(2.dp))
        Text(text = subtitle, color = Lime, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun IronLineChart(
    points: List<ChartPoint>,
    unit: String = "kg",
    emptyText: String = "Registre pelo menos 2 sessões para visualizar o gráfico."
) {
    if (points.size < 2) {
        Text(
            text = emptyText,
            color = TextMuted,
            fontSize = 13.sp,
            modifier = Modifier.padding(vertical = 10.dp)
        )
        return
    }

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(148.dp)
            .padding(top = 8.dp)
    ) {
        val padX = 28.dp.toPx()
        val padTop = 22.dp.toPx()
        val padBottom = 22.dp.toPx()
        val chartW = (size.width - padX * 2).coerceAtLeast(1f)
        val chartH = (size.height - padTop - padBottom).coerceAtLeast(1f)

        val minVal = points.minOf { it.value }
        val maxVal = points.maxOf { it.value }
        val span = (maxVal - minVal).takeIf { it > 0.0001 } ?: 1.0

        val coords = points.mapIndexed { idx, p ->
            val x = padX + (idx.toFloat() / (points.size - 1)) * chartW
            val y = size.height - padBottom - (((p.value - minVal) / span).toFloat() * chartH)
            Triple(x, y, p)
        }

        // Subtle baseline
        drawLine(
            color = BorderSubtle,
            start = Offset(padX, size.height - padBottom),
            end = Offset(size.width - padX, size.height - padBottom),
            strokeWidth = 1.dp.toPx()
        )

        val path = Path().apply {
            coords.forEachIndexed { idx, (x, y, _) ->
                if (idx == 0) moveTo(x, y) else lineTo(x, y)
            }
        }
        drawPath(
            path = path,
            color = Lime,
            style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
        )

        val valPaint = android.graphics.Paint().apply {
            color = android.graphics.Color.parseColor("#E4E4E7")
            textSize = 10.sp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isFakeBoldText = true
            isAntiAlias = true
        }
        val lblPaint = android.graphics.Paint().apply {
            color = android.graphics.Color.parseColor("#71717A")
            textSize = 9.sp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }

        coords.forEach { (x, y, pt) ->
            drawCircle(color = Lime, radius = 4.dp.toPx(), center = Offset(x, y))
            drawContext.canvas.nativeCanvas.drawText(
                "${IronLogViewModel.formatKg(pt.value)}$unit",
                x,
                y - 8.dp.toPx(),
                valPaint
            )
            drawContext.canvas.nativeCanvas.drawText(
                pt.label,
                x,
                size.height - 4.dp.toPx(),
                lblPaint
            )
        }
    }
}

@Composable
fun IronBarChart(bars: List<ChartPoint>) {
    if (bars.isEmpty()) {
        Text("Sem volume registrado ainda.", color = TextMuted, fontSize = 13.sp)
        return
    }
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(145.dp)
            .padding(top = 8.dp)
    ) {
        val padX = 8.dp.toPx()
        val padTop = 20.dp.toPx()
        val padBottom = 22.dp.toPx()
        val maxVal = (bars.maxOf { it.value }).coerceAtLeast(1.0)
        val slotW = (size.width - padX * 2) / bars.size
        val barW = slotW * 0.62f
        val chartH = (size.height - padTop - padBottom).coerceAtLeast(1f)

        val valPaint = android.graphics.Paint().apply {
            color = android.graphics.Color.parseColor("#E4E4E7")
            textSize = 9.5.sp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isFakeBoldText = true
            isAntiAlias = true
        }
        val lblPaint = android.graphics.Paint().apply {
            color = android.graphics.Color.parseColor("#71717A")
            textSize = 9.sp.toPx()
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }

        bars.forEachIndexed { idx, b ->
            val h = ((b.value / maxVal).toFloat() * chartH).coerceAtLeast(3.dp.toPx())
            val x = padX + idx * slotW + (slotW - barW) / 2f
            val y = size.height - padBottom - h
            drawRoundRect(
                color = if (b.value > 0) Lime.copy(alpha = 0.88f) else Surface3,
                topLeft = Offset(x, y),
                size = Size(barW, h),
                cornerRadius = CornerRadius(4.dp.toPx(), 4.dp.toPx())
            )
            if (b.value > 0) {
                drawContext.canvas.nativeCanvas.drawText(
                    b.value.roundToInt().toString(),
                    x + barW / 2f,
                    y - 5.dp.toPx(),
                    valPaint
                )
            }
            drawContext.canvas.nativeCanvas.drawText(
                b.label,
                x + barW / 2f,
                size.height - 4.dp.toPx(),
                lblPaint
            )
        }
    }
}

@Composable
fun BrandHeader(username: String? = null, role: String? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(11.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(Lime)
            )
            Spacer(Modifier.width(8.dp))
            Column {
                Text(
                    text = "FÉ & FERRO",
                    color = TextPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "TREINE COM PROPÓSITO.",
                    color = Lime,
                    fontWeight = FontWeight.Bold,
                    fontSize = 9.sp,
                    letterSpacing = 1.1.sp
                )
            }
        }
        if (username != null) {
            IronBadge(text = "@$username", accent = role == "ADMIN")
        }
    }
}
